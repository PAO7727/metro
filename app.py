from flask import Flask, jsonify, send_from_directory
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

# ── Líneas ───────────────────────────────────
@app.route('/api/lineas')
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

# ── Estaciones de una línea (en orden) ───────
@app.route('/api/estaciones_linea/<int:id_linea>')
def estaciones_linea(id_linea):
    try:
        con = conectar()
        cur = con.cursor(dictionary=True)
        cur.execute("""
            SELECT e.*, r.orden,
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

# ── Todas las estaciones ─────────────────────
@app.route('/api/estaciones')
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

# ── Trenes ───────────────────────────────────
@app.route('/api/trenes')
@app.route('/api/trenes/<int:id_linea>')
def trenes(id_linea=None):
    try:
        con = conectar()
        cur = con.cursor(dictionary=True)
        sql = """
            SELECT t.*,
                l.nombre AS nombre_linea,
                l.color  AS color_linea,
                c.id_cochera,
                e.nombre AS estacion_cochera
            FROM tren t
            LEFT JOIN linea    l ON l.id_linea   = t.id_linea
            LEFT JOIN cochera  c ON c.id_cochera = t.id_cochera
            LEFT JOIN estacion e ON e.id_estacion = c.id_estacion
        """
        if id_linea:
            cur.execute(sql + " WHERE t.id_linea = %s ORDER BY t.id_tren", (id_linea,))
        else:
            cur.execute(sql + " ORDER BY t.id_linea, t.id_tren")
        resultado = cur.fetchall()
        cur.close(); con.close()
        return jsonify(resultado)
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
        # Agrupar por estación
        grupos = {}
        for f in filas:
            key = f['id_estacion']
            if key not in grupos:
                grupos[key] = {'id_estacion': key, 'estacion': f['estacion'], 'accesos': []}
            grupos[key]['accesos'].append('Acceso #' + str(f['id_acceso']))
        return jsonify(list(grupos.values()))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Cocheras ─────────────────────────────────
@app.route('/api/cocheras')
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
