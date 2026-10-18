export class VigieError extends Error {
  /**
   * @param {string} code machine-readable code, e.g. PORT_IN_USE
   * @param {string} message human-readable message
   * @param {object} [details] extra data returned to the client
   * @param {number} [status] HTTP status
   */
  constructor(code, message, details = undefined, status = 400) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}
