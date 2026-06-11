export function* enumerate<T>(arr: T[]) {
  for (let i = 0; i < arr.length; i++) {
    yield [i, arr[i], arr] as [number, T, T[]];
  }
}
