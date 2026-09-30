export const GLOBAL_SEARCH_MIN_LENGTH = 3;

export const normalizeSearchTerm = (value: string): string | undefined => {
    const term = value.trim();

    if (!term || term.length < GLOBAL_SEARCH_MIN_LENGTH) {
        return undefined;
    }

    return term;
};

export const hasShortSearchTerm = (value: string): boolean => {
    const term = value.trim();
    return term.length > 0 && term.length < GLOBAL_SEARCH_MIN_LENGTH;
};
