export function validateNews(input) {
  const body = typeof input?.body === 'string' ? input.body.trim() : '';
  if (!body || body.length > 3000) throw new Error('News must contain between 1 and 3,000 characters.');
  return { body };
}

export function codeIsActive(post, now = Date.now()) {
  return post.kind === 'code' && Boolean(post.code) && Number.isFinite(Date.parse(post.expires_at)) && Date.parse(post.expires_at) > now && post.code_date === new Date(now).toISOString().slice(0, 10);
}
