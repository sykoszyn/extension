import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc, RpcError, type RpcMap, type RpcMethod } from '@shared/rpc';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: { code: string; message: string } | null;
  reload: (override?: Partial<RpcMap[RpcMethod]['req']>) => void;
}

/**
 * Calls a background RPC method. Re-runs when `params` (JSON) changes.
 * Pass `null` params to skip the call (e.g. missing player id).
 */
export function useRpc<M extends RpcMethod>(method: M, params: RpcMap[M]['req'] | null): AsyncState<RpcMap[M]['res']> {
  const [data, setData] = useState<RpcMap[M]['res']>();
  const [loading, setLoading] = useState(params !== null);
  const [error, setError] = useState<AsyncState<unknown>['error']>(null);
  const seq = useRef(0);
  const key = params === null ? null : JSON.stringify(params);

  const run = useCallback(
    (override?: object) => {
      if (key === null) return;
      const id = ++seq.current;
      setLoading(true);
      setError(null);
      rpc(method, { ...JSON.parse(key), ...(override ?? {}) })
        .then((d) => id === seq.current && setData(d))
        .catch((e: unknown) => {
          if (id !== seq.current) return;
          const err = e instanceof RpcError ? { code: e.code, message: e.message } : { code: 'INTERNAL', message: String(e) };
          setError(err);
        })
        .finally(() => id === seq.current && setLoading(false));
    },
    [method, key],
  );

  useEffect(() => {
    if (key === null) {
      setData(undefined);
      setLoading(false);
      return;
    }
    run();
  }, [key, run]);

  return { data, loading, error, reload: run };
}
