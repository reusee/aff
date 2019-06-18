export function eq(...args: any[]) {
  for (let i = 0; i < args.length; i += 2) {
    const left = args[i]
    const right = args[i+1]
    if (left != right) {
      console.log(left)
      console.log(right)
      throw new Error('pair ' + i + ' not equal')
    }
  }
}
