import { z } from "zod";

import { type ContactTopic, contactTopics } from "@/lib/validation/contact-topics";

export { type ContactTopic, contactTopics } from "@/lib/validation/contact-topics";

export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
    email: z.email("Informe um e-mail válido.").max(254, "E-mail muito longo."),
    topic: z.enum(Object.keys(contactTopics) as [ContactTopic, ...ContactTopic[]], "Escolha um assunto."),
    message: z
      .string()
      .trim()
      .min(10, "Escreva pelo menos 10 caracteres.")
      .max(5000, "Use no máximo 5.000 caracteres."),
    referenceUrl: z
      .string()
      .trim()
      .max(500, "Endereço muito longo.")
      .optional()
      .transform((value) => (value ? value : null))
      .refine((value) => value === null || /^https?:\/\//i.test(value), "Informe um endereço que comece com http:// ou https://."),
    // Campo invisível para pessoas; robôs costumam preenchê-lo.
    website: z.string().max(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.topic === "copyright" && !value.referenceUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["referenceUrl"],
        message: "Informe o link do material na plataforma para que possamos analisá-lo.",
      });
    }
  });

export type ContactInput = z.infer<typeof contactSchema>;
