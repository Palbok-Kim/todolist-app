import { asObject, checkText } from './common.js';

// VR-07
const NAME_MAX = 30;

export function validateCategory(body) {
  const r = checkText(asObject(body).name, { max: NAME_MAX });
  return r.error
    ? { value: {}, fields: [{ field: 'name', message: r.error }] }
    : { value: { name: r.value }, fields: [] };
}
