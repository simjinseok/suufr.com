import { z } from "zod";
import { zfd } from "zod-form-data";

export default zfd.formData({
  paidAt: zfd.text(z.string().date()),
  amount: zfd.numeric(z.number()),
  notes: zfd.text(z.optional(z.string())),
  paymentMethod: zfd.text(z.string()),
});
