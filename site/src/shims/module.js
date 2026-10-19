export const createRequire = () => Object.assign(() => ({}), { resolve: x => '/' + x });
export default { createRequire };
