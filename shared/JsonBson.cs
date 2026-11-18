using System;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MongoDB.Bson;

namespace database_seed
{
    /// <summary>
    /// Plain JSON to BSON and back, matching the Node backup contract: ObjectIds are 24-char hex
    /// strings, dates are ISO 8601 strings, numbers stay numbers. The archive never carries
    /// MongoDB extended JSON.
    /// </summary>
    public static class JsonBson
    {
        //The only fields that hold dates; a comment body may look exactly like a timestamp.
        private static readonly Regex IsoDate = new Regex(
            "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z$", RegexOptions.CultureInvariant);
        private static readonly Regex HexId = new Regex("^[0-9a-fA-F]{24}$", RegexOptions.CultureInvariant);
        private static readonly string[] DateFields =
        {
            "date_time", "created_at", "updated_at", "started_at", "finished_at"
        };

        /// <summary>Parses plain JSON into BSON without turning ids or date text into BSON types.</summary>
        public static BsonValue ToPlainBson(JsonNode node, string key = "")
        {
            switch (node)
            {
                case JsonObject item:
                {
                    var document = new BsonDocument();
                    foreach (var property in item)
                    {
                        document[property.Key] = ToPlainBson(property.Value!, property.Key);
                    }
                    return document;
                }
                case JsonArray list:
                {
                    var array = new BsonArray();
                    foreach (var child in list)
                    {
                        array.Add(ToPlainBson(child!, key));
                    }
                    return array;
                }
                case JsonValue value:
                    return Scalar(value);
                default:
                    return BsonNull.Value;
            }
        }

        /// <summary>Parses plain JSON, restoring ObjectIds and known date fields as BSON types.</summary>
        public static BsonValue ToDatabaseBson(JsonNode node, string key = "")
        {
            switch (node)
            {
                case JsonObject item:
                {
                    var document = new BsonDocument();
                    foreach (var property in item)
                    {
                        document[property.Key] = ToDatabaseBson(property.Value!, property.Key);
                    }
                    return document;
                }
                case JsonArray list:
                {
                    var array = new BsonArray();
                    foreach (var child in list)
                    {
                        array.Add(ToDatabaseBson(child!, key));
                    }
                    return array;
                }
                case JsonValue value:
                    return DatabaseScalar(value, key);
                default:
                    return BsonNull.Value;
            }
        }

        /// <summary>Converts a database value into the plain archive form.</summary>
        public static JsonNode? ToJson(BsonValue value)
        {
            switch (value.BsonType)
            {
                case BsonType.Document:
                {
                    var document = new JsonObject();
                    foreach (var element in value.AsBsonDocument)
                    {
                        document[element.Name] = ToJson(element.Value);
                    }
                    return document;
                }
                case BsonType.Array:
                {
                    var array = new JsonArray();
                    foreach (var child in value.AsBsonArray)
                    {
                        array.Add(ToJson(child));
                    }
                    return array;
                }
                case BsonType.ObjectId:
                    return JsonValue.Create(value.AsObjectId.ToString());
                case BsonType.DateTime:
                    return JsonValue.Create(value.ToUniversalTime().ToString(
                        "yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture));
                case BsonType.Binary:
                    return JsonValue.Create(Convert.ToBase64String(value.AsBsonBinaryData.Bytes));
                case BsonType.Int32:
                    return JsonValue.Create(value.AsInt32);
                case BsonType.Int64:
                    return JsonValue.Create(value.AsInt64);
                case BsonType.Double:
                    return JsonValue.Create(value.AsDouble);
                case BsonType.Decimal128:
                    return JsonValue.Create(value.AsDecimal128.ToString());
                case BsonType.Boolean:
                    return JsonValue.Create(value.AsBoolean);
                case BsonType.String:
                    return JsonValue.Create(value.AsString);
                case BsonType.Null:
                    return null;
                default:
                    throw new InvalidOperationException("Unsupported BSON type in a backup: " + value.BsonType);
            }
        }

        private static BsonValue Scalar(JsonValue value)
        {
            switch (value.GetValueKind())
            {
                case JsonValueKind.Null:
                case JsonValueKind.Undefined:
                    return BsonNull.Value;
                case JsonValueKind.True:
                    return BsonBoolean.True;
                case JsonValueKind.False:
                    return BsonBoolean.False;
                case JsonValueKind.Number:
                    //JavaScript numbers are doubles; keep the type a Node restore would write.
                    return new BsonDouble(value.GetValue<double>());
                case JsonValueKind.String:
                    return new BsonString(value.GetValue<string>());
                default:
                    throw new InvalidOperationException("Unsupported JSON value in a backup: " + value.GetValueKind());
            }
        }

        private static BsonValue DatabaseScalar(JsonValue value, string key)
        {
            if (value.GetValueKind() == JsonValueKind.String)
            {
                var text = value.GetValue<string>();
                if (key == "_id" && HexId.IsMatch(text))
                {
                    return new BsonObjectId(ObjectId.Parse(text));
                }
                if (Array.IndexOf(DateFields, key) >= 0 && IsoDate.IsMatch(text))
                {
                    var date = DateTime.Parse(text, CultureInfo.InvariantCulture,
                        DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal);
                    return new BsonDateTime(date);
                }
                return new BsonString(text);
            }
            return Scalar(value);
        }
    }
}
