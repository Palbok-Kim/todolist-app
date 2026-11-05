// SO-06: 한 줄 JSON을 stdout으로. time은 epoch 밀리초 숫자(XQ-10)
function write(level, fields) {
  console.log(JSON.stringify({ time: Date.now(), level, ...fields }));
}

export const logger = {
  info: (fields) => write('info', fields),
  error: (fields) => write('error', fields),
};
