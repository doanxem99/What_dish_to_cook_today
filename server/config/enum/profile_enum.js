const ProfileStatus_Create =
{
    Success : 0,
    Exception : 1,
    NameFormatException : 1,
    NameUsed : 2
}
const ProfileStatus_PostCreate =
{
    CreatingSuccess : 0,
    EditingSuccess : 1,
    Exception : 2
}
const ProfileStatus_Detail =
{
    Success : 0,
    Exception : 1
}
const ProfileStatus_PostDetail =
{
    Success : 0,
    Exception : 1
}
const ProfileStatus_SetBestPost =
{
    Success : 0,
    Exception : 1
}
const Status_Code_Website = {
    Success: 200,
    NotFound: 404,
    BadRequest: 400,
    Unauthorized: 401,
    Forbidden: 403,
    InternalServerError: 500,
    ServiceUnavailable: 503,
    GatewayTimeout: 504,
}

module.exports = {
    ProfileStatus_Create,
    ProfileStatus_PostCreate,
    ProfileStatus_Detail,
    ProfileStatus_PostDetail,
    ProfileStatus_SetBestPost,
    Status_Code_Website
};