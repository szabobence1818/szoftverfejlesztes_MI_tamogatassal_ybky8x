using CarConfigurator.Api.Models;

namespace CarConfigurator.Api.Repositories;

public interface IConfigurationRepository
{
    SavedConfiguration Add(SavedConfiguration entity);
    SavedConfiguration? GetById(int id);
    IReadOnlyList<SavedConfiguration> GetByUserId(string userId);
    SavedConfiguration Update(SavedConfiguration entity);
    bool Delete(int id);
}
