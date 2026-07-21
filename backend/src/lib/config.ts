import 'dotenv/config'

const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-sec...n',
  databasePath: process.env.DATABASE_PATH ||
    '/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/alertacar.db',
  sccon: {
    orgUuid: process.env.SCCON_ORG_UUID || '597953b9-ee78-4113-80f9-803dbbaa60a0',
    startDate: process.env.SCCON_START_DATE || '2019-07-22',
  },
  wfs: {
    baseUrl: process.env.WFS_BASE_URL || 'https://geo.sema.mt.gov.br/geoserver/ows',
    authkey: process.env.WFS_AUTHKEY || '541085de-9a2e-454e-bdba-eb3d57a2f492',
  },
  bcryptRounds: 12,
  jwtExpiresIn: '7d',
}

export default config
