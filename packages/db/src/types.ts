import type {
  adminAccounts,
  adminSessions,
  adminTwoFactor,
  adminUsers,
  adminVerifications,
  auditLogs,
  categories,
  heroSlides,
  productImages,
  products,
  rateLimitCounters,
  signupIntents,
  slugReservations,
  storeAccounts,
  storeSessions,
  stores,
  storeUsers,
  storeVerifications,
} from "../schema/index";

/** Tipos inferidos del esquema, para repositories y services de `apps/api`. */

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;
export type AdminAccount = typeof adminAccounts.$inferSelect;
export type NewAdminAccount = typeof adminAccounts.$inferInsert;
export type AdminVerification = typeof adminVerifications.$inferSelect;
export type NewAdminVerification = typeof adminVerifications.$inferInsert;
export type AdminTwoFactor = typeof adminTwoFactor.$inferSelect;
export type NewAdminTwoFactor = typeof adminTwoFactor.$inferInsert;

export type StoreUser = typeof storeUsers.$inferSelect;
export type NewStoreUser = typeof storeUsers.$inferInsert;
export type StoreSession = typeof storeSessions.$inferSelect;
export type NewStoreSession = typeof storeSessions.$inferInsert;
export type StoreAccount = typeof storeAccounts.$inferSelect;
export type NewStoreAccount = typeof storeAccounts.$inferInsert;
export type StoreVerification = typeof storeVerifications.$inferSelect;
export type NewStoreVerification = typeof storeVerifications.$inferInsert;

export type SignupIntent = typeof signupIntents.$inferSelect;
export type NewSignupIntent = typeof signupIntents.$inferInsert;

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
export type HeroSlide = typeof heroSlides.$inferSelect;
export type NewHeroSlide = typeof heroSlides.$inferInsert;

export type SlugReservation = typeof slugReservations.$inferSelect;
export type NewSlugReservation = typeof slugReservations.$inferInsert;

export type RateLimitCounter = typeof rateLimitCounters.$inferSelect;
export type NewRateLimitCounter = typeof rateLimitCounters.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
