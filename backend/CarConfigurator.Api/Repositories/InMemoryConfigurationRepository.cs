using CarConfigurator.Api.Models;

namespace CarConfigurator.Api.Repositories;

public class InMemoryConfigurationRepository : IConfigurationRepository
{
    private readonly List<SavedConfiguration> _storage = new();
    private readonly object _lock = new();
    private int _nextId = 1;

    public SavedConfiguration Add(SavedConfiguration entity)
    {
        lock (_lock)
        {
            var copy = Clone(entity);
            copy.Id = _nextId++;
            copy.CreatedAt = DateTime.UtcNow;
            copy.UpdatedAt = copy.CreatedAt;
            _storage.Add(copy);
            return Clone(copy);
        }
    }

    public SavedConfiguration? GetById(int id)
    {
        lock (_lock)
        {
            var existing = _storage.FirstOrDefault(x => x.Id == id);
            return existing == null ? null : Clone(existing);
        }
    }

    public IReadOnlyList<SavedConfiguration> GetByUserId(string userId)
    {
        lock (_lock)
        {
            return _storage
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.UpdatedAt)
                .Select(Clone)
                .ToList();
        }
    }

    public SavedConfiguration Update(SavedConfiguration entity)
    {
        lock (_lock)
        {
            var existing = _storage.FirstOrDefault(x => x.Id == entity.Id)
                ?? throw new KeyNotFoundException($"SavedConfiguration #{entity.Id} not found.");

            existing.Name = entity.Name;
            existing.EngineOptionId = entity.EngineOptionId;
            existing.SelectedOptionIds = new List<int>(entity.SelectedOptionIds);
            existing.SavedTotalPrice = entity.SavedTotalPrice;
            existing.UpdatedAt = DateTime.UtcNow;

            return Clone(existing);
        }
    }

    public bool Delete(int id)
    {
        lock (_lock)
        {
            var existing = _storage.FirstOrDefault(x => x.Id == id);
            if (existing == null)
            {
                return false;
            }

            _storage.Remove(existing);
            return true;
        }
    }

    private static SavedConfiguration Clone(SavedConfiguration source) => new()
    {
        Id = source.Id,
        Name = source.Name,
        UserId = source.UserId,
        EngineOptionId = source.EngineOptionId,
        SelectedOptionIds = new List<int>(source.SelectedOptionIds),
        SavedTotalPrice = source.SavedTotalPrice,
        CreatedAt = source.CreatedAt,
        UpdatedAt = source.UpdatedAt
    };
}
