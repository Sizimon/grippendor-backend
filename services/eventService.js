const db = require('../utils/db')

/** PARAMS
 * Create or update an event in the database.
 * If an event with the same guild_id and name already exists, it will be updated.
 * @param {Object} event - The event details.
 * @returns {string|null} - The ID of the created or updated event, or null if no rows were affected.
 */

async function createEvent(event) {
    const query = `
        INSERT INTO events (guild_id, game_name, name, channel_id, summary, description, event_date, thumbnail_url, image_urls)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (guild_id, name) DO UPDATE
        SET game_name = EXCLUDED.game_name,
            channel_id = EXCLUDED.channel_id,
            summary = EXCLUDED.summary,
            description = EXCLUDED.description,
            event_date = EXCLUDED.event_date,
            thumbnail_url = EXCLUDED.thumbnail_url,
            image_urls = EXCLUDED.image_urls,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id;
    `;
    const values = [
        event.guildId,
        event.gameName,
        event.name,
        event.channelId,
        event.summary,
        event.description,
        event.eventDate,
        event.thumbnailUrl,
        event.imageUrls,
    ];

    try {
        const result = await db.query(query, values);
        return result.rows[0]?.id || null;
    } catch (error) {
        console.error('Error creating event:', error);
        throw new Error('Failed to create event in the database');
    }
}

module.exports = {
    createEvent
};