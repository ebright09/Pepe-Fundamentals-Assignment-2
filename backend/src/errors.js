/**
 * An error that is safe to show a user. Anything thrown that is *not* an
 * ApiError is treated as a bug and reported generically, so internal details
 * and upstream messages never leak to the client.
 */
export class ApiError extends Error {
  constructor(status, message, fields = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (fields) this.fields = fields;
  }

  static badRequest(message, fields) {
    return new ApiError(400, message, fields);
  }
  static unauthorized(message = 'You must be signed in to do that.') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have access to that contact.') {
    return new ApiError(403, message);
  }
  static notFound(message = 'That contact does not exist, or is not yours.') {
    return new ApiError(404, message);
  }
}
