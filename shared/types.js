/**
 * @typedef {Object} ProjectionEntry
 * @property {string} rawName
 * @property {number} PTS
 * @property {number} REB
 * @property {number} AST
 * @property {number} STL
 * @property {number} BLK
 * @property {number} THREEPM
 * @property {number} FGPCT
 * @property {number} FTPCT
 * @property {number} TO
 * @property {number} [FGA]
 * @property {number} [FTA]
 */

/** @typedef {Object.<string, ProjectionEntry>} ProjectionsMap */

/**
 * @typedef {Object} Settings
 * @property {Object.<string,string>} columnMapping
 * @property {number|null} csvUploadedAt
 * @property {number} projectionsPlayerCount
 */

/**
 * @typedef {Object} RosterEntry
 * @property {string} playerNameRaw
 * @property {string} playerNameNormalized
 * @property {string|null} positionSlot
 * @property {string|null} matchedProjectionKey
 * @property {number} timestampDetected
 * @property {"observer"|"manual"} source
 */

/**
 * @typedef {Object} DraftState
 * @property {RosterEntry[]} myRoster
 * @property {string|null} lastProcessedDomSignature
 */

export {};
