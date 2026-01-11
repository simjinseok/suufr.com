import * as arctic from 'arctic';

const domain = process.env.COGNITO_DOMAIN!;
const cognito = new arctic.AmazonCognito(domain, process.env.COGNITO_CLIENT_ID!, process.env.COGNITO_CLIENT_SECRET!, process.env.COGNITO_REDIRECT_URI!);

export default cognito;
