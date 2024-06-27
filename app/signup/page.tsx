'use client';
import { useFormState } from 'react-dom';
import { signUp } from './actions';

export default function Page() {
    const [state, action, isPending] = useFormState<any, any>(signUp, {});
    return (
        <form method="POST" action={action}>
            <div>
                <input type="text" name="email"/>
            </div>

            <div>
                <input type="password" name="password"/>
            </div>

            <button type="submit">회원가입</button>

        </form>
    )
}