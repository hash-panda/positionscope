const http = require('http');

const MAX_ATTEMPTS = 30;
const RETRY_INTERVAL = 1000; // 1 second

function checkVite(attempt = 1) {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000', (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Vite dev server is ready!');
        resolve();
      } else {
        retry();
      }
    });

    req.on('error', () => {
      retry();
    });

    function retry() {
      if (attempt < MAX_ATTEMPTS) {
        console.log(`⏳ Waiting for Vite... (${attempt}/${MAX_ATTEMPTS})`);
        setTimeout(() => {
          checkVite(attempt + 1).then(resolve).catch(reject);
        }, RETRY_INTERVAL);
      } else {
        reject(new Error('Vite dev server did not start in time'));
      }
    }
  });
}

checkVite()
  .then(() => {
    console.log('🚀 Starting Electron...');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
