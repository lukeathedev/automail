# AutoMail

## Pré-requisitos

- Node.js

## Informações

Mais informações em src/index.ts.

## Configuração

Crie um arquivo '.env' no root do projeto especificando:

```
IMAP_USER=usuario@email.com
IMAP_PASS=senha-do-email
```

Observe, também, as configurações padrão em src/config.ts.

## Utilizando a Ferramenta

Futuramente, será criado um deployment docker rodando em prod mode. Por enquanto,
execute, caso seja a primeira execução:

```sh
npm install
```

e, nas demais execuções, apenas:

```sh
npm run start:dev
```

no terminal (powershell, cmd, bash).