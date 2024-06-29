import { z } from "zod";
import { zfd } from "zod-form-data";

export default zfd.formData({
  name: zfd.text(z.string()),
  status: zfd.text(z.string()),
  notes: zfd.text(z.optional(z.string())),
});
