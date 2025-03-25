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

export default {
    ProfileStatus_Create,
    ProfileStatus_PostCreate,
    ProfileStatus_Detail,
    ProfileStatus_PostDetail
};