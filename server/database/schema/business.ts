import { relations } from 'drizzle-orm'
import {
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp
} from 'drizzle-orm/pg-core'
import { organization, user } from './auth'

// Simple ID generator (8 chars alphanumeric)
const generateId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}

// ─────────────────────────────────────────────
// Leads
// ─────────────────────────────────────────────
export const leads = pgTable('leads', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'set null' }),
  sessionId: text('session_id').notNull(),
  toolSessionId: text('tool_session_id'),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  labels: json('labels').$type<string[]>(),
  metadata: json('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
})

// ─────────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────────
export const contacts = pgTable('contacts', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name'),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  notes: text('notes'),
  tags: json('tags').$type<string[]>(),
  source: text('source'),
  metadata: json('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
})

// ─────────────────────────────────────────────
// Submissions
// ─────────────────────────────────────────────
export const submissions = pgTable('submissions', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  formName: text('form_name').notNull(),
  name: text('name'),
  email: text('email'),
  phone: text('phone'),
  message: text('message'),
  sessionId: text('session_id'),
  toolSessionId: text('tool_session_id'),
  metadata: json('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
})

// ─────────────────────────────────────────────
// Addresses (polymorphic - links to leads, contacts, submissions)
// ─────────────────────────────────────────────
export const addresses = pgTable('addresses', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  source: text('source'),
  streetAddress: text('street_address').notNull(),
  streetAddress2: text('street_address_2'),
  postOfficeBoxNumber: text('post_office_box_number'),
  addressLocality: text('address_locality').notNull(),
  addressRegion: text('address_region').notNull(),
  addressCountry: text('address_country'),
  postalCode: text('postal_code').notNull(),
  latitude: text('latitude'),
  longitude: text('longitude'),
  // Roof estimation data
  roofAreaSqFt: integer('roof_area_sq_ft'),
  pricePerSquare: integer('price_per_square'),
  estimate: integer('estimate'),
  predominantPitchType: text('predominant_pitch_type'),
  roofOutlinePoints: json('roof_outline_points').$type<Array<{ lat: number, lng: number }>>(),
  roofPitchSegments: json('roof_pitch_segments').$type<Array<{
    pitchDegrees: number
    pitchRatio: string
    pitchType: string
    azimuthDegrees: number
    direction: string
    areaSqFt: number
  }>>(),
  // Polymorphic foreign keys
  leadId: text('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
  submissionId: text('submission_id').references(() => submissions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
})

// ─────────────────────────────────────────────
// Contact-Lead Junction Table (M2M)
// ─────────────────────────────────────────────
export const contactLeads = pgTable(
  'contact_leads',
  {
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    matchType: text('match_type', { enum: ['email', 'phone', 'manual'] }).notNull()
  },
  table => ({
    pk: primaryKey({ columns: [table.contactId, table.leadId] })
  })
)

// ─────────────────────────────────────────────
// Contact-Submission Junction Table (M2M)
// ─────────────────────────────────────────────
export const contactSubmissions = pgTable(
  'contact_submissions',
  {
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    submissionId: text('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    matchType: text('match_type', { enum: ['email', 'phone', 'manual'] }).notNull()
  },
  table => ({
    pk: primaryKey({ columns: [table.contactId, table.submissionId] })
  })
)

// ─────────────────────────────────────────────
// Relations (defined after all tables)
// ─────────────────────────────────────────────
export const leadsRelations = relations(leads, ({ one, many }) => ({
  organization: one(organization, {
    fields: [leads.organizationId],
    references: [organization.id]
  }),
  user: one(user, {
    fields: [leads.userId],
    references: [user.id]
  }),
  addresses: many(addresses),
  contactLeads: many(contactLeads)
}))

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organization, {
    fields: [contacts.organizationId],
    references: [organization.id]
  }),
  addresses: many(addresses),
  contactLeads: many(contactLeads),
  contactSubmissions: many(contactSubmissions)
}))

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  organization: one(organization, {
    fields: [submissions.organizationId],
    references: [organization.id]
  }),
  addresses: many(addresses),
  contactSubmissions: many(contactSubmissions)
}))

export const addressesRelations = relations(addresses, ({ one }) => ({
  organization: one(organization, {
    fields: [addresses.organizationId],
    references: [organization.id]
  }),
  lead: one(leads, {
    fields: [addresses.leadId],
    references: [leads.id]
  }),
  contact: one(contacts, {
    fields: [addresses.contactId],
    references: [contacts.id]
  }),
  submission: one(submissions, {
    fields: [addresses.submissionId],
    references: [submissions.id]
  })
}))

export const contactLeadsRelations = relations(contactLeads, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactLeads.contactId],
    references: [contacts.id]
  }),
  lead: one(leads, {
    fields: [contactLeads.leadId],
    references: [leads.id]
  })
}))

export const contactSubmissionsRelations = relations(contactSubmissions, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactSubmissions.contactId],
    references: [contacts.id]
  }),
  submission: one(submissions, {
    fields: [contactSubmissions.submissionId],
    references: [submissions.id]
  })
}))

// ─────────────────────────────────────────────
// Type exports for use in queries
// ─────────────────────────────────────────────
export type Lead = typeof leads.$inferSelect
export type InsertLead = typeof leads.$inferInsert
export type Contact = typeof contacts.$inferSelect
export type InsertContact = typeof contacts.$inferInsert
export type Submission = typeof submissions.$inferSelect
export type InsertSubmission = typeof submissions.$inferInsert
export type Address = typeof addresses.$inferSelect
export type InsertAddress = typeof addresses.$inferInsert
