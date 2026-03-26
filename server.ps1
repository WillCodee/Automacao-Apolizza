$port = 8080
$folder = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Servidor rodando em http://localhost:$port" -ForegroundColor Green
Write-Host "Pasta: $folder" -ForegroundColor Gray
Write-Host "Pressione CTRL+C para parar." -ForegroundColor Yellow

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ($urlPath -eq '' -or $urlPath -eq '/') { $urlPath = 'dashboard.html' }

        $filePath = Join-Path $folder $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = switch ($ext) {
                '.html' { 'text/html; charset=utf-8' }
                '.css'  { 'text/css' }
                '.js'   { 'application/javascript' }
                '.json' { 'application/json' }
                '.png'  { 'image/png' }
                '.jpg'  { 'image/jpeg' }
                '.ico'  { 'image/x-icon' }
                default { 'application/octet-stream' }
            }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
            $response.ContentType = 'text/plain'
            $response.ContentLength64 = $body.Length
            $response.OutputStream.Write($body, 0, $body.Length)
        }

        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
}
