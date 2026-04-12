import { z } from "zod";

/**
 * Validation schemas for all form inputs.
 * Criterion 4 — Input Validation (Zod).
 */

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  role: z.enum(["buyer", "farmer"], { required_error: "Please select a role" }),
});

export const createListingSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  categoryId: z.string().uuid("Please select a category"),
  price: z.number().positive("Price must be greater than 0"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.enum(["kg", "bag", "crate", "bunch", "each"]),
});

export const editListingSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  price: z.number().positive("Price must be greater than 0"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.enum(["kg", "bag", "crate", "bunch", "each"]),
});

export const validate = (schema, data) => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, errors: null, data: result.data };
  }
  const errors = {};
  result.error.issues.forEach((issue) => {
    errors[issue.path.join(".")] = issue.message;
  });
  return { success: false, errors, data: null };
};
