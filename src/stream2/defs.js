export const STATIC_CREATOR_KEY = {};
export const STD_DISCONNECT_REQ = 'disconnect';
export const DEFAULT_START_TTMP = -1000000;
export const EMPTY_OBJECT = {
  /* <debug> */
  EMPTY_OBJECT: 'EMPTY_OBJECT',
  /* </debug> */
};
export const EMPTY_FUNCTION = () => EMPTY_OBJECT;
export const STATIC_PROJECTS = {
  STRAIGHT: (data) => data,
  AIO: (...args) => args,
  SURFACE_EQUAL: (x, y) => x === y,
  EMPTY_REDUCER: () => EMPTY_FUNCTION,
};
export const STATIC_GETTERS = {
  STRAIGHT: (value) => value,
};
export const FROM_OWNER_STREAM = {
  /* <debug> */
  FROM_OWNER_STREAM: 'FROM_OWNER_STREAM',
  /* </debug> */
};
export const UNIQUE_MINOR_VALUE = {
  /* <debug> */
  UNIQUE_MINOR_VALUE: 'UNIQUE_MINOR_VALUE',
  /* </debug> */
};
