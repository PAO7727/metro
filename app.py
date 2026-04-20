from flask import Flask, jsonify, send_from_directory, request
import mysql.connector
import os

app = Flask(__name__, static_folder='.')

# =============================================
#  CONFIGURACIÓN DE LA BASE DE DATOS - RAILWAY
# =============================================
def conectar():
    return mysql.connector.connect(
        host     = os.environ.get('MYSQLHOST'),
        port     = int(os.environ.get('MYSQLPORT')),
        user     = os.environ.get('MYSQLUSER'),
        password = os.environ.get('MYSQLPASSWORD'),
        database = os.environ.get('MYSQLDATABASE'),
        connection_timeout=5
    )

# ── Página principal ─────────────────────────
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/style.css')
def css():
    return send_from_directory('.', 'style.css')

@app.route('/app.js')
def js():
    return send_from_directory('.', 'app.js')

# ── Resumen / estadísticas ───────────────────
@app.route('/api/resumen')
def resumen():
    try:
        con = conectar()
        cur = con.cursor(dictionary=True)
        datos = {}
        for tabla in ['linea', 'estacion', 'tren', 'cochera', 'acceso']:
            cur.execute(f"SELECT COUNT(*) AS total FROM {tabla}")
            datos[tabla + 's'] = cur.fetchone()['total']
        cur.close(); con.close()
        return jsonify(datos)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Líneas: GET ──────────────────────────────
@app.route('/api/lineas', methods=['GET'])
def lineas():
    try:
        con = conectar()
        cur = con.cursor(dictionary=True)
        cur.execute("""
            SELECT l.*,
                COUNT(DISTINCT r.id_estacion) AS num_estaciones,
                COUNT(DISTINCT t.id_tren)     AS num_trenes
            FROM linea l
            LEFT JOIN ruta  r ON r.id_linea = l.id_linea
            LEFT JOIN tren  t ON t.id_linea = l.id_linea
            GROUP BY l.id_linea
            ORDER BY l.id_linea
        """)
        resultado = cur.fetchall()
        cur.close(); con.close()
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Líneas: POST (agregar) ───────────────────
@app.route('/api/lineas', methods=['POST'])
def agregar_linea():
    try:
        data      = request.get_json()
        id_linea  = data.get('id_linea')
        nombre    = data.get('nombre', '').strip()
        direccion = data.get('direccion', '').strip()
        color     = data.get('color', '').strip()

        if not id_linea or not nombre:
            return jsonify({'error': 'La línea debe tener ID y nombre'}), 400
        if int(id_linea) <= 0:
            return jsonify({'error': 'El ID de la línea debe ser un número positivo'}), 400

        con = conectar()
        cur = con.cursor()
        cur.execute("SELECT COUNT(*) FROM linea WHERE id_linea = %s", (id_linea,))
        if cur.fetchone()[0] > 0:
            return jsonify({'error': f'Ya existe una línea con ID {id_linea}'}), 400

        cur.execute("""
            INSERT INTO linea (id_linea, nombre, direccion, color)
            VALUES (%s, %s, %s, %s)
        """, (id_linea, nombre, direccion or None, color or None))

        con.commit()
        cur.close(); con.close()
        return jsonify({'mensaje': 'Línea agregada correctamente'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Estaciones de una línea (en orden) ───────
@app.route('/api/estaciones_linea/<int:id_linea>')
def estaciones_linea(id_linea):
    try:
        con = conectar()
        cur = con.cursor(dictionary=True)
        cur.execute("""
            SELECT e.*, r.orden, r.id_ruta,
                (SELECT COUNT(*) FROM acceso a WHERE a.id_estacion = e.id_estacion) AS num_accesos,
                c.id_cochera
            FROM ruta r
            JOIN estacion e ON e.id_estacion = r.id_estacion
            LEFT JOIN cochera c ON c.id_estacion = e.id_estacion
            WHERE r.id_linea = %s
            ORDER BY r.orden
        """, (id_linea,))
        resultado = cur.fetchall()
        cur.close(); con.close()
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Todas las estaciones: GET ────────────────
@app.route('/api/estaciones', methods=['GET'])
def estaciones():
    try:
        con = conectar()
        cur = con.cursor(dictionary=True)
        cur.execute("""
            SELECT e.*,
                (SELECT COUNT(*) FROM acceso a WHERE a.id_estacion = e.id_estacion) AS num_accesos,
                (SELECT COUNT(*) FROM cochera c WHERE c.id_estacion = e.id_estacion) AS tiene_cochera,
                GROUP_CONCAT(DISTINCT l.nombre ORDER BY l.id_linea SEPARATOR ', ') AS lineas
            FROM estacion e
            LEFT JOIN ruta r ON r.id_estacion = e.id_estacion
            LEFT JOIN linea l ON l.id_linea = r.id_linea
            GROUP BY e.id_estacion
            ORDER BY e.nombre
        """)
        resultado = cur.fetchall()
        cur.close(); con.close()
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Estaciones: POST (agregar) ───────────────
@app.route('/api/estaciones', methods=['POST'])
def agregar_estacion():
    try:
        data        = request.get_json()
        id_estacion = data.get('id_estacion')
        nombre      = data.get('nombre', '').strip()
        direccion   = data.get('direccion', '').strip()
        andenes     = data.get('andenes')

        if not id_estacion or not nombre:
            return jsonify({'error': 'La estación debe tener ID y nombre'}), 400
        if int(id_estacion) <= 0:
            return jsonify({'error': 'El ID de la estación debe ser un número positivo'}), 400

        con = conectar()
        cur = con.cursor()
        cur.execute("SELECT COUNT(*) FROM estacion WHERE id_estacion = %s", (id_estacion,))
        if cur.fetchone()[0] > 0:
            return jsonify({'error': f'Ya existe una estación con ID {id_estacion}'}), 400

        cur.execute("""
            INSERT INTO estacion (id_estacion, nombre, direccion, andenes)
            VALUES (%s, %s, %s, %s)
        """, (id_estacion, nombre, direccion or None, andenes or None))

        con.commit()
        cur.close(); con.close()
        return jsonify({'mensaje': 'Estación agregada correctamente'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Rutas: GET (siguiente id_ruta disponible) ─
@app.route('/api/ruta/siguiente_id')
def siguiente_id_ruta():
    try:
        con = conectar()
        cur = con.cursor(dictionary=True)
        cur.execute("SELECT COALESCE(MAX(id_ruta), 0) + 1 AS siguiente FROM ruta")
        resultado = cur.fetchone()
        cur.close(); con.close()
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Rutas: POST (asignar estación a línea) ───
# REGLA: una estación nunca puede dejar de pertenecer a una línea
@app.route('/api/rutas', methods=['POST'])
def agregar_ruta():
    try:
        data        = request.get_json()
        id_linea    = data.get('id_linea')
        id_estacion = data.get('id_estacion')
        orden       = data.get('orden')

        if not id_linea or not id_estacion or not orden:
            return jsonify({'error': 'Debes indicar línea, estación y orden'}), 400
        if int(orden) <= 0:
            return jsonify({'error': 'El orden debe ser un número positivo'}), 400

        con = conectar()
        cur = con.cursor()

        # Validar que la línea existe
        cur.execute("SELECT COUNT(*) FROM linea WHERE id_linea = %s", (id_linea,))
        if cur.fetchone()[0] == 0:
            return jsonify({'error': 'La línea seleccionada no existe'}), 400

        # Validar que la estación existe
        cur.execute("SELECT COUNT(*) FROM estacion WHERE id_estacion = %s", (id_estacion,))
        if cur.fetchone()[0] == 0:
            return jsonify({'error': 'La estación seleccionada no existe'}), 400

        # REGLA: una estación nunca puede dejar de pertenecer a una línea
        # Por eso solo se permite agregar, nunca eliminar
        cur.execute("""
            SELECT COUNT(*) FROM ruta
            WHERE id_linea = %s AND id_estacion = %s
        """, (id_linea, id_estacion))
        if cur.fetchone()[0] > 0:
            return jsonify({'error': 'Esta estación ya pertenece a esta línea'}), 400

        # Validar que el orden no esté ocupado en esa línea
        cur.execute("""
            SELECT COUNT(*) FROM ruta
            WHERE id_linea = %s AND orden = %s
        """, (id_linea, orden))
        if cur.fetchone()[0] > 0:
            return jsonify({'error': f'Ya existe una estación en la posición {orden} de esta línea'}), 400

        # Obtener siguiente id_ruta automáticamente
        cur.execute("SELECT COALESCE(MAX(id_ruta), 0) + 1 AS siguiente FROM ruta")
        id_ruta = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO ruta (id_ruta, id_linea, id_estacion, orden)
            VALUES (%s, %s, %s, %s)
        """, (id_ruta, id_linea, id_estacion, orden))

        con.commit()
        cur.close(); con.close()
        return jsonify({'mensaje': f'Estación asignada correctamente a la línea en posición {orden}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Trenes: GET (listar) ─────────────────────
@app.route('/api/trenes', methods=['GET'])
def trenes():
    try:
        id_linea = request.args.get('id_linea')
        con = conectar()
        cur = con.cursor(dictionary=True)
        query = """
            SELECT t.id_tren, t.id_linea, l.nombre AS nombre_linea,
                   t.id_cochera, e.nombre AS estacion_cochera
            FROM tren t
            LEFT JOIN linea    l ON l.id_linea   = t.id_linea
            LEFT JOIN cochera  c ON c.id_cochera  = t.id_cochera
            LEFT JOIN estacion e ON e.id_estacion = c.id_estacion
        """
        if id_linea:
            query += " WHERE t.id_linea = %s ORDER BY t.id_tren"
            cur.execute(query, (id_linea,))
        else:
            query += " ORDER BY t.id_tren"
            cur.execute(query)
        resultado = cur.fetchall()
        cur.close(); con.close()
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Trenes: POST (agregar) ───────────────────
@app.route('/api/trenes', methods=['POST'])
def agregar_tren():
    try:
        data       = request.get_json()
        id_tren    = data.get('id_tren')
        id_linea   = data.get('id_linea')
        id_cochera = data.get('id_cochera')

        if not id_tren or not id_cochera:
            return jsonify({'error': 'El tren debe tener ID y cochera obligatoriamente'}), 400
        if int(id_tren) <= 0:
            return jsonify({'error': 'El ID del tren debe ser un número positivo'}), 400

        con = conectar()
        cur = con.cursor()

        cur.execute("SELECT COUNT(*) FROM tren WHERE id_tren = %s", (id_tren,))
        if cur.fetchone()[0] > 0:
            return jsonify({'error': f'Ya existe un tren con ID {id_tren}'}), 400

        cur.execute("SELECT COUNT(*) FROM cochera WHERE id_cochera = %s", (id_cochera,))
        if cur.fetchone()[0] == 0:
            return jsonify({'error': 'La cochera seleccionada no existe'}), 400

        if id_linea:
            cur.execute("SELECT COUNT(*) FROM linea WHERE id_linea = %s", (id_linea,))
            if cur.fetchone()[0] == 0:
                return jsonify({'error': 'La línea seleccionada no existe'}), 400

            # REGLA: mín trenes = N° estaciones
            cur.execute("SELECT COUNT(*) FROM ruta WHERE id_linea = %s", (id_linea,))
            num_estaciones = cur.fetchone()[0]

            # REGLA: máx trenes = 2 × N° estaciones
            cur.execute("SELECT COUNT(*) FROM tren WHERE id_linea = %s", (id_linea,))
            num_trenes = cur.fetchone()[0]

            if num_estaciones > 0 and (num_trenes + 1) < num_estaciones:
                return jsonify({'error': f'La línea necesita mínimo {num_estaciones} trenes. Tiene {num_trenes}.'}), 400
            if (num_trenes + 1) > (num_estaciones * 2):
                return jsonify({'error': f'Máximo permitido: {num_estaciones * 2} trenes (doble de estaciones). Tiene {num_trenes}.'}), 400

        cur.execute("""
            INSERT INTO tren (id_tren, id_linea, id_cochera)
            VALUES (%s, %s, %s)
        """, (id_tren, id_linea if id_linea else None, id_cochera))

        con.commit()
        cur.close(); con.close()
        return jsonify({'mensaje': 'Tren agregado correctamente'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Cocheras: GET ────────────────────────────
@app.route('/api/cocheras', methods=['GET'])
def cocheras():
    try:
        con = conectar()
        cur = con.cursor(dictionary=True)
        cur.execute("""
            SELECT c.*, e.nombre AS estacion,
                COUNT(t.id_tren) AS num_trenes
            FROM cochera c
            JOIN estacion e ON e.id_estacion = c.id_estacion
            LEFT JOIN tren t ON t.id_cochera = c.id_cochera
            GROUP BY c.id_cochera
            ORDER BY c.id_cochera
        """)
        resultado = cur.fetchall()
        cur.close(); con.close()
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Cocheras: POST (agregar) ─────────────────
@app.route('/api/cocheras', methods=['POST'])
def agregar_cochera():
    try:
        data        = request.get_json()
        id_cochera  = data.get('id_cochera')
        id_estacion = data.get('id_estacion')

        if not id_cochera or not id_estacion:
            return jsonify({'error': 'La cochera debe tener ID y estación asignada'}), 400
        if int(id_cochera) <= 0:
            return jsonify({'error': 'El ID de la cochera debe ser un número positivo'}), 400

        con = conectar()
        cur = con.cursor()

        cur.execute("SELECT COUNT(*) FROM estacion WHERE id_estacion = %s", (id_estacion,))
        if cur.fetchone()[0] == 0:
            return jsonify({'error': 'La estación seleccionada no existe'}), 400

        cur.execute("SELECT COUNT(*) FROM cochera WHERE id_cochera = %s", (id_cochera,))
        if cur.fetchone()[0] > 0:
            return jsonify({'error': f'Ya existe una cochera con ID {id_cochera}'}), 400

        cur.execute("""
            INSERT INTO cochera (id_cochera, id_estacion)
            VALUES (%s, %s)
        """, (id_cochera, id_estacion))

        con.commit()
        cur.close(); con.close()
        return jsonify({'mensaje': 'Cochera agregada correctamente'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Accesos de una línea ─────────────────────
@app.route('/api/accesos_linea/<int:id_linea>')
def accesos_linea(id_linea):
    try:
        con = conectar()
        cur = con.cursor(dictionary=True)
        cur.execute("""
            SELECT e.id_estacion, e.nombre AS estacion,
                   a.id_acceso
            FROM ruta r
            JOIN estacion e ON e.id_estacion = r.id_estacion
            JOIN acceso   a ON a.id_estacion = e.id_estacion
            WHERE r.id_linea = %s
            ORDER BY r.orden, a.id_acceso
        """, (id_linea,))
        filas = cur.fetchall()
        cur.close(); con.close()
        grupos = {}
        for f in filas:
            key = f['id_estacion']
            if key not in grupos:
                grupos[key] = {'id_estacion': key, 'estacion': f['estacion'], 'accesos': []}
            grupos[key]['accesos'].append('Acceso #' + str(f['id_acceso']))
        return jsonify(list(grupos.values()))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
