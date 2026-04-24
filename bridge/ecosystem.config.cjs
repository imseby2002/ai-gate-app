module.exports = {
  apps: [{
    name: 'aigate-wa-bridge',
    script: 'index.js',
    interpreter: 'node',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      // 以下在 Oracle Cloud 上用 .env 或直接設定
      // API_KEY: 'your-secret-key',
      // AIGATE_URL: 'https://your-app.vercel.app',
    },
  }],
}
