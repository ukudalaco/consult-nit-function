export type VoidFunction = () => void;

export type FunctionWithArg<A = unknown, R = void> = (arg: A) => R;
export type FunctionWithArgOptional<A = unknown, R = void> = (arg?: A) => R;

export type CallbackFunction<R = unknown> = FunctionWithArg<FunctionWithArg<R>>;
