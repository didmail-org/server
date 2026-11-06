// Workers fetch performs transport decompression; node-fetch over emulated node:http can double-handle it.
const WorkerHeaders = Headers;
const WorkerRequest = Request;
const WorkerResponse = Response;
const WorkerFormData = FormData;
const WorkerBlob = Blob;
export default globalThis.fetch.bind(globalThis);
export {
  WorkerHeaders as Headers,
  WorkerRequest as Request,
  WorkerResponse as Response,
  WorkerFormData as FormData,
  WorkerBlob as Blob,
};
