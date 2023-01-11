module.exports = {
  apps: [
    {
      name: 'app1',
      script: './index.js',
      log_date_format: 'YYYY/MM/DD HH:mm:ss',
      instances: 2,
      exec_mode: 'cluster',
    },
  ],
};
