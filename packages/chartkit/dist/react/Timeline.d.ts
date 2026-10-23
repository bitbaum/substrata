export interface TimelineEvent {
    /** ISO date. */
    date: string;
    label: string;
    href?: string;
    /** Which way it moved things: drawn in the up/down colours. */
    tone?: "up" | "down" | "neutral";
    /** Free text carried as `data-kind` for an app's own styling. */
    kind?: string;
}
export interface TimelineProps {
    events: TimelineEvent[];
    caption: string;
    /** ISO dates. Left out, the axis runs from the month of the first event to the month after the last. */
    from?: string;
    to?: string;
}
/**
 * Events on a horizontal date axis with month ticks. Each event is an anchor
 * — a dot on its date and its label beside it; events that would collide
 * stack into a second lane rather than overprint. The label sits to the
 * right in the left part of the axis and to the left near its end, and is
 * never wider than the room to its neighbour.
 */
export declare function Timeline({ events, caption, from, to }: TimelineProps): import("react").JSX.Element;
//# sourceMappingURL=Timeline.d.ts.map