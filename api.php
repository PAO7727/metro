<?php
// =============================================
//  api.php  —  Backend REST en PHP
//  Devuelve JSON para cada recurso
// =============================================
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once 'config.php';

$accion = $_GET['accion'] ?? '';

try {
    $pdo = conectar();

    switch ($accion) {

        // ---------- LÍNEAS ----------
        case 'lineas':
            $sql = "SELECT l.*,
                        COUNT(DISTINCT r.id_estacion) AS num_estaciones,
                        COUNT(DISTINCT t.id_tren)     AS num_trenes
                    FROM linea l
                    LEFT JOIN ruta  r ON r.id_linea = l.id_linea
                    LEFT JOIN tren  t ON t.id_linea = l.id_linea
                    GROUP BY l.id_linea
                    ORDER BY l.id_linea";
            echo json_encode($pdo->query($sql)->fetchAll());
            break;

        // ---------- ESTACIONES DE UNA LÍNEA (en orden) ----------
        case 'estaciones_linea':
            $id = (int)($_GET['id_linea'] ?? 0);
            $sql = "SELECT e.*, r.orden,
                        (SELECT COUNT(*) FROM acceso a WHERE a.id_estacion = e.id_estacion) AS num_accesos,
                        c.id_cochera
                    FROM ruta r
                    JOIN estacion e ON e.id_estacion = r.id_estacion
                    LEFT JOIN cochera c ON c.id_estacion = e.id_estacion
                    WHERE r.id_linea = :id
                    ORDER BY r.orden";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':id' => $id]);
            echo json_encode($stmt->fetchAll());
            break;

        // ---------- TODAS LAS ESTACIONES ----------
        case 'estaciones':
            $sql = "SELECT e.*,
                        (SELECT COUNT(*) FROM acceso a WHERE a.id_estacion = e.id_estacion) AS num_accesos,
                        (SELECT COUNT(*) FROM cochera c WHERE c.id_estacion = e.id_estacion) AS tiene_cochera,
                        GROUP_CONCAT(DISTINCT l.nombre ORDER BY l.id_linea SEPARATOR ', ') AS lineas
                    FROM estacion e
                    LEFT JOIN ruta r ON r.id_estacion = e.id_estacion
                    LEFT JOIN linea l ON l.id_linea = r.id_linea
                    GROUP BY e.id_estacion
                    ORDER BY e.nombre";
            echo json_encode($pdo->query($sql)->fetchAll());
            break;

        // ---------- TRENES ----------
        case 'trenes':
            $id_linea = $_GET['id_linea'] ?? null;
            $sql = "SELECT t.*,
                        l.nombre AS nombre_linea,
                        l.color  AS color_linea,
                        c.id_cochera,
                        e.nombre AS estacion_cochera
                    FROM tren t
                    LEFT JOIN linea   l ON l.id_linea   = t.id_linea
                    LEFT JOIN cochera c ON c.id_cochera = t.id_cochera
                    LEFT JOIN estacion e ON e.id_estacion = c.id_estacion";
            if ($id_linea !== null) {
                $sql .= " WHERE t.id_linea = :id";
                $stmt = $pdo->prepare($sql . " ORDER BY t.id_tren");
                $stmt->execute([':id' => (int)$id_linea]);
            } else {
                $stmt = $pdo->query($sql . " ORDER BY t.id_linea, t.id_tren");
            }
            echo json_encode($stmt->fetchAll());
            break;

        // ---------- ACCESOS DE UNA LÍNEA ----------
        case 'accesos_linea':
            $id = (int)($_GET['id_linea'] ?? 0);
            $sql = "SELECT e.id_estacion, e.nombre AS estacion,
                        a.id_acceso, a.id_estacion AS acc_est
                    FROM ruta r
                    JOIN estacion e ON e.id_estacion = r.id_estacion
                    JOIN acceso   a ON a.id_estacion = e.id_estacion
                    WHERE r.id_linea = :id
                    ORDER BY r.orden, a.id_acceso";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':id' => $id]);
            $filas = $stmt->fetchAll();
            // Agrupar por estación
            $resultado = [];
            foreach ($filas as $f) {
                $key = $f['id_estacion'];
                if (!isset($resultado[$key])) {
                    $resultado[$key] = [
                        'id_estacion' => $f['id_estacion'],
                        'estacion'    => $f['estacion'],
                        'accesos'     => []
                    ];
                }
                $resultado[$key]['accesos'][] = 'Acceso #' . $f['id_acceso'];
            }
            echo json_encode(array_values($resultado));
            break;

        // ---------- COCHERAS ----------
        case 'cocheras':
            $sql = "SELECT c.*, e.nombre AS estacion,
                        COUNT(t.id_tren) AS num_trenes
                    FROM cochera c
                    JOIN estacion e ON e.id_estacion = c.id_estacion
                    LEFT JOIN tren t ON t.id_cochera = c.id_cochera
                    GROUP BY c.id_cochera
                    ORDER BY c.id_cochera";
            echo json_encode($pdo->query($sql)->fetchAll());
            break;

        // ---------- RESUMEN / ESTADÍSTICAS ----------
        case 'resumen':
            $datos = [
                'lineas'     => $pdo->query("SELECT COUNT(*) FROM linea")->fetchColumn(),
                'estaciones' => $pdo->query("SELECT COUNT(*) FROM estacion")->fetchColumn(),
                'trenes'     => $pdo->query("SELECT COUNT(*) FROM tren")->fetchColumn(),
                'cocheras'   => $pdo->query("SELECT COUNT(*) FROM cochera")->fetchColumn(),
                'accesos'    => $pdo->query("SELECT COUNT(*) FROM acceso")->fetchColumn(),
            ];
            echo json_encode($datos);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no válida. Usa: lineas, estaciones, estaciones_linea, trenes, accesos_linea, cocheras, resumen']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
