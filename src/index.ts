//                 _                        _ _
//      /\        | |                      (_) |
//     /  \  _   _| |_ ___  _ __ ___   __ _ _| |
//    / /\ \| | | | __/ _ \| '_ ` _ \ / _` | | |
//   / ____ \ |_| | || (_) | | | | | | (_| | | |
//  /_/    \_\__,_|\__\___/|_| |_| |_|\__,_|_|_|

// Autor:      Lucas Alvarenga (lb.am.alvarenga@uel.br)
// Inspiração: https://github.com/mscdex/node-imap/issues/407#issuecomment-1096557833
// Descrição:  Automaticamente 'ouve' a caixa de entrada
// especificada em 'config.json' para e-mails com anexos
// com extensões apropriadas vindos de um domínio.
// Criação:    2022-06-24

// Basicamente, o programa abre seu inbox e aguarda novos
// e-mails que dão match no filtro FROM do IMAP.
// Então, ele baixa os anexos apropriados para uma pasta
// pré-configurada, cujos nomes refletem a data UNIX atual.

import config from "./config";
import "dotenv/config";

const { Base64Decode } = require("base64-stream");

const log = require("simple-node-logger").createSimpleLogger();
log.setLevel(config.log.level);

import fs from "fs";
import Imap, { Box, ImapMessage, ImapMessageAttributes } from "imap";
import { Stream } from "stream";

const imap = new Imap({
  user: String(process.env.IMAP_USER),
  password: String(process.env.IMAP_PASS),
  ...config.imap,
});

var LAST_MSG = 1;

imap.once("ready", () => {
  // Open inbox and get latest mail id
  imap.openBox("INBOX", true, (err: Error, box: Box) => {
    if (err || !box.uidvalidity) throw err;

    LAST_MSG = box.uidnext;
    log.info(`Opened inbox (latest uid: #${LAST_MSG})`);
  });
});

// Wait for new mail
imap.on("mail", (num: number) => {
  if (num > 1) return;

  // HACK: should we really search all msgs?
  // Filter from relevant domain
  imap.search([["FROM", config.fromDomain]], (err: Error, uids: number[]) => {
    uids = uids.filter((a: number) => {
      return a >= LAST_MSG;
    });

    if (uids.length < 1) return;

    const f = imap.fetch(uids[uids.length - 1], {
      bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)"],
      struct: true,
      markSeen: true,
    });

    let from = "";
    let date = "";

    f.on("message", (msg: ImapMessage, seqno: number) => {
      msg.on("body", (stream: Stream, info: any) => {
        let buf = "";
        stream.on("data", (chunk: any) => {
          buf += chunk.toString("utf8");
        });
        stream.once("end", () => {
          const ph = Imap.parseHeader(buf);

          from = ph.from[0];
          date = ph.date[0];
          log.debug(
            `Received e-mail (#${seqno}, uid=${LAST_MSG}): ${from} (${date})`
          );
        });
      });

      msg.once("attributes", (attrs: ImapMessageAttributes) => {
        const atts = getAttachments(attrs.struct, null).filter((att: any) =>
          isValidFile(att.params?.name)
        );

        if (atts.length < 1) return;

        log.info(
          `Received e-mail with ${atts.length} valid attachment${
            atts.length !== 1 ? "s" : ""
          }`
        );
        for (let i = 0; i < atts.length; ++i) {
          const att = atts[i];
          const f = imap.fetch(attrs.uid, {
            bodies: [att.partID],
            struct: true,
          });

          f.on("message", writeAttachment(att));
        }
      });
    });

    LAST_MSG++;
  });
});

imap.once("error", (err: Error) => {
  log.error(err);
});

imap.once("end", () => {
  log.info("Connection closed");
});

imap.connect();

const getAttachments = (struct: any, atts: any) => {
  atts = atts || [];
  for (let i = 0; i < struct.length; ++i) {
    if (Array.isArray(struct[i])) {
      getAttachments(struct[i], atts);
    } else if (
      struct[i].disposition &&
      ["inline", "attachment"].indexOf(
        struct[i].disposition.type.toLowerCase()
      ) > -1
    ) {
      atts.push(struct[i]);
    }
  }

  return atts;
};

const writeAttachment = (attachment: any) => {
  const filename = `${config.downloads.path}/${new Date().valueOf()}`;
  log.debug(`Writing to ${filename}`);

  const encoding = attachment.encoding;

  return function (msg: ImapMessage, seqno: number) {
    msg.on("body", function (stream: any, info: any) {
      //Create a write stream so that we can stream the attachment to file;
      log.debug(info);
      var writeStream = fs.createWriteStream(filename);
      writeStream.on("finish", function () {
        log.debug("Write complete");
      });

      //so we decode during streaming using
      if (encoding.toLowerCase() === "base64") {
        //the stream is base64 encoded, so here the stream is decode on the fly and piped to the write stream (file)
        stream.pipe(new Base64Decode()).pipe(writeStream);
      } else {
        //here we have none or some other decoding streamed directly to the file which renders it useless probably
        stream.pipe(writeStream);
      }
    });
    msg.once("end", function () {
      log.info(`Attachment downloaded: ${filename}`);
    });
  };
};

const isValidFile = (fn: string) => {
  if (!fn) return false;

  const split = fn.split(".");
  return (
    config.downloads.ext.indexOf(split[split.length - 1].toLowerCase()) > -1
  );
};
