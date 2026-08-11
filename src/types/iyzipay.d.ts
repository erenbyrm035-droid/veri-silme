// iyzipay resmi tip bildirimi sağlamadığından minimal ambient tanım.
declare module "iyzipay" {
  interface IyzipayOptions { apiKey: string; secretKey: string; uri: string }
  type Callback = (err: unknown, result: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  class Iyzipay {
    constructor(options: IyzipayOptions);
    checkoutFormInitialize: { create(request: unknown, cb: Callback): void };
    checkoutForm: { retrieve(request: unknown, cb: Callback): void };
  }
  export default Iyzipay;
}
