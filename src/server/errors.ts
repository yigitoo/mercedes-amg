/** Servislerin fırlattığı, kullanıcıya olduğu gibi gösterilebilecek iş kuralı hatası. */
export class DomainError extends Error {
  constructor(
    message: string,
    /** Hatanın ait olduğu form alanı (varsa); form bu alanın altında gösterir. */
    readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
