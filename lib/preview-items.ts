/** Keep long lists compact without changing the underlying selection. */
export function previewItems<T>(items:readonly T[],expanded:boolean):readonly T[]{return expanded?items:items.slice(0,3)}
