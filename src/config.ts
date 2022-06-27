const config = {
  imap: {
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false,
    },
  },
  fromDomain: "@uel.br",
  downloads: {
    path: "./downloads",
    ext: ["csv", "xlsx"],
  },
  log: {
    level: process.env.LOGLEVEL || "debug",
  },
};

export default config;
