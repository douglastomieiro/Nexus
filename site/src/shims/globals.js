// Faz o código do servidor (escrito para Node) rodar no Worker do navegador.
globalThis.process ??= { env: {}, versions: {}, platform: 'browser', cwd: () => '/' };
