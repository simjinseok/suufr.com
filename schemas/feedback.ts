import { z } from "zod";
import { zfd } from "zod-form-data";

export default zfd.formData({
  notes: zfd.text(z.optional(z.string())),
});
