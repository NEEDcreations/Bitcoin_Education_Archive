export function pack(category, rows) {
    return rows.map(function (row) {
        return {
            id: row[0],
            category: category,
            question: row[1],
            answer: row[2],
            topics: row[3],
            sources: row[4],
            alts: row[5]
        };
    });
}
