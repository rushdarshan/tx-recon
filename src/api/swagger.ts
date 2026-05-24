import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Transaction Reconciliation Engine API',
      version: '1.0.0',
      description: 'Reconcile crypto transactions between user and exchange CSV files.',
    },
    servers: [{ url: '/' }],
  },
  apis: ['./src/api/routes.ts'],
}

export const swaggerSpec = swaggerJsdoc(options)
