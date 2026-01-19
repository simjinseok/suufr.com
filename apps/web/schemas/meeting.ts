import { z } from "zod";
import { zfd } from "zod-form-data";

export default zfd.formData({
  name: zfd.text(z.string()),
  notes: zfd.text(z.optional(z.string())),
  phone: zfd.text(z.optional(z.string())),
  isDone: zfd.checkbox(),
  meetingAt: zfd.text(z.string().datetime({ offset: true })),
});
