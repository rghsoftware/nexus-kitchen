export {
	signIn,
	signUp,
	signOut,
	requestPasswordReset,
	updatePassword,
	resendConfirmation,
	AuthFailure,
	type SignUpOutcome
} from './authService';
export { authErrorMessage } from './authErrors';
export {
	MIN_PASSWORD_LENGTH,
	validateEmail,
	validatePassword,
	validateSignIn,
	validateSignUp
} from './validation';
