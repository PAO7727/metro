<?php
// =============================================
//  CONFIGURACIÓN DE LA BASE DE DATOS - RAILWAY
// =============================================
define('DB_HOST',    'mysql.railway.internal');
define('DB_PORT',    '3306');
define('DB_USER',    'root');
define('DB_PASS',    'EDvXzhJWTpPMqtselPdYOLHcqsWrKWVm');
define('DB_NAME',    'railway');
define('DB_CHARSET', 'utf8mb4');

function conectar(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $opciones = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $opciones);
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['error' => 'Error de conexión: ' . $e->getMessage()]));
        }
    }
    return $pdo;
}
?>
