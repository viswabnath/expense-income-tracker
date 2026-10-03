import { ChevronDown } from 'lucide-react';
import type { Question } from './content';

/** Questions as native disclosure widgets: keyboard and screen reader friendly, no script needed */
export function FaqList({ items }: { items: Question[] }) {
    return (
        <div className="faq">
            {items.map(item => (
                <details key={item.q} className="reveal">
                    <summary>
                        {item.q}
                        <ChevronDown size={20} aria-hidden="true" />
                    </summary>
                    <p>{item.a}</p>
                </details>
            ))}
        </div>
    );
}
