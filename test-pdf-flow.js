require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const token = jwt.sign({ user: process.env.ADMIN_USER, ts: Date.now() }, process.env.JWT_SECRET, { expiresIn: '24h' });
const pdfPath = __dirname + '/ListasCostos/A2 - DETAL - Lista de Precios 25 MAYO 26.pdf';

async function test() {
  const buf = fs.readFileSync(pdfPath);
  const boundary = '----TestBoundary' + Date.now();
  const CRLF = '\r\n';
  
  const parts = [];
  parts.push(Buffer.from('--' + boundary + CRLF + 'Content-Disposition: form-data; name="file"; filename="test.pdf"' + CRLF + 'Content-Type: application/pdf' + CRLF + CRLF));
  parts.push(buf);
  parts.push(Buffer.from(CRLF + '--' + boundary + '--' + CRLF));
  const bodyBuf = Buffer.concat(parts);

  const result = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/productos/import-pdf',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': bodyBuf.length
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
  console.log('Status:', result.status);
  console.log('Body:', result.body.substring(0, 500));
}

test().catch(e => console.error(e));
