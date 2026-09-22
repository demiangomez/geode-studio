from rest_framework.views import exception_handler
from django.db.utils import IntegrityError
from psycopg2.errors import CheckViolation
from rest_framework.response import Response
from rest_framework import status
from drf_standardized_errors.handler import ExceptionHandler
from rest_framework.exceptions import APIException
from django.db.utils import DataError as DatabaseDataErrorException
from django.core.exceptions import SuspiciousOperation
from rest_framework.exceptions import PermissionDenied


class CustomIntegrityErrorExceptionHandler(APIException):
    """
        Class built mainly for handling some foreign key errors,
        which are not handled by Django models,
        but by the database itself. With this class, we can
        display error details to the user.
    """
    status_code = 400
    default_code = 'IntegrityError occurred in db.'
    default_detail = 'IntegrityError occurred in db.'


class CustomDataErrorExceptionHandler(APIException):
    status_code = 400
    default_code = 'DataError occurred in db.'
    default_detail = 'DataError occurred in db.'


class CustomValidationErrorExceptionHandler(APIException):
    status_code = 400
    default_code = 'ValidationError occurred.'
    default_detail = 'ValidationError occurred.'


class CustomServerErrorExceptionHandler(APIException):
    status_code = 400
    default_code = 'ServerError occurred.'
    default_detail = 'ServerError occurred.'


class EtmErrorExceptionHandler(CustomValidationErrorExceptionHandler):
    """
        Raised when the ETM run fails (views.TimeSeries). Carries the console
        debug output of the run, returned in the error response as 'debug_output'
        so the user can inspect the problem.
    """

    def __init__(self, detail=None, debug_output=''):
        super().__init__(detail)
        self.debug_output = debug_output


class SuspiciousOperationExceptionHandler(APIException):
    status_code = 400
    default_code = 'ValidationError occurred.'
    default_detail = 'ValidationError occurred.'


class PermissionDeniedOnGetHandler(PermissionDenied):
    default_detail = 'You do not have permission to view this content.'


class CustomExceptionHandler(ExceptionHandler):
    """
        This custom handler makes custom handlers perform instead of the default ones.
    """

    def convert_known_exceptions(self, exc: Exception) -> Exception:
        if isinstance(exc, IntegrityError):
            # db CHECK constraint: keep only the primary message, without the
            # 'DETAIL: Failing row contains (...)' dump of the whole row
            if isinstance(exc.__cause__, CheckViolation):
                return CustomIntegrityErrorExceptionHandler(exc.__cause__.diag.message_primary)
            return CustomIntegrityErrorExceptionHandler(str(exc))
        elif isinstance(exc, DatabaseDataErrorException):
            return CustomDataErrorExceptionHandler(str(exc))
        elif issubclass(type(exc), SuspiciousOperation):
            return SuspiciousOperationExceptionHandler(str(exc))
        elif isinstance(exc, PermissionDenied) and self.context and self.context.get('request') and self.context.get('request').method == 'GET':
            return PermissionDeniedOnGetHandler()
        else:
            return super().convert_known_exceptions(exc)

    def format_exception(self, exc: APIException) -> dict:
        data = super().format_exception(exc)

        # top-level key, so the {type, errors} format the front already handles stays the same
        if isinstance(exc, EtmErrorExceptionHandler):
            data['debug_output'] = exc.debug_output

        return data
