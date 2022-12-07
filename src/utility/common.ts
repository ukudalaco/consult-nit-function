import { NITS_REGEX } from './const';

export const delayPromise = (time: number) => {
  return new Promise<void>(function (resolve) {
    const tout = setTimeout(() => {
      clearTimeout(tout);
      resolve();
    }, time);
  });
};

export const delayRace = <T>(promise: T, time: number) => {
  return Promise.race([delayPromise(time), promise]);
};

export const chunkArray = <T>(array: Array<T>, n: number) => {
  return [...Array(Math.ceil(array.length / n))].map((_, i) =>
    array.slice(i * n, (i + 1) * n)
  );
};

export const validateQueryNit = (queryNit: string) =>
  NITS_REGEX.test(queryNit) || queryNit === '';
